/*
# Add username authentication mapping and enable realtime chat delivery

1. Authentication support
- Create `profiles` with one row per Supabase auth user.
- Store a normalized, unique username for each account.
- Add a trigger that creates the profile from the username supplied during sign-up.
- Add a narrowly scoped SECURITY DEFINER lookup function so the frontend can sign in with a username while Supabase Auth continues to protect passwords.

2. Security
- Enable RLS on `profiles`.
- Allow authenticated users to read, create, update, and delete only their own profile row.
- Do not expose the profiles table to anonymous users.
- Restrict the username lookup function to returning only the matching auth email and grant execution only to the roles needed by the sign-in form.
- Fix the function search path so it cannot be changed by callers.

3. Realtime
- Add `chat_messages` to the Supabase realtime publication when it is not already present, allowing new chat messages to reach connected clients.

4. Important notes
- Supabase Auth still stores and verifies the email and password securely; the visible sign-in form now accepts a username and uses this mapping only to find the Auth email.
- Existing accounts without a profile row must create a new account or be assigned a username before username sign-in can work.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username = lower(username) AND username ~ '^[a-z0-9][a-z0-9_.-]{2,29}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON public.profiles;
CREATE POLICY "delete_own_profile" ON public.profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    lower(trim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')))
  )
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

CREATE OR REPLACE FUNCTION public.lookup_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT u.email
  FROM auth.users AS u
  JOIN public.profiles AS p ON p.id = u.id
  WHERE p.username = lower(trim(p_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_email_by_username(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;