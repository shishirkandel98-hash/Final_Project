CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, country, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    CASE WHEN NEW.email = 'admin@gmail.com' THEN true ELSE false END
  );
  
  -- Assign role
  IF NEW.email = 'admin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR (
    _role = 'admin' AND EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = _user_id AND email = 'shishirxkandel@gmail.com'
    )
  )
$$;


--
-- Name: is_approved(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT approved FROM public.profiles WHERE id = _user_id),
    false
  )
$$;


SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    table_name text NOT NULL,
    record_id uuid,
    action text NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    current_balance numeric(15,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_account_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    remarks text,
    image_url text,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blocked_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    blocked_by uuid,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: loans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    remarks text,
    image_url text,
    loan_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    refunded_at timestamp with time zone,
    refund_transaction_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bank_account_id uuid,
    CONSTRAINT loans_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'refunded'::text])))
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text,
    last_name text,
    phone text,
    country text,
    approved boolean DEFAULT false,
    approved_at timestamp with time zone,
    approved_by uuid,
    report_email text
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category_id uuid,
    type text NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text,
    remarks text,
    image_url text,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bank_account_id uuid,
    CONSTRAINT transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: blocked_emails blocked_emails_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_emails
    ADD CONSTRAINT blocked_emails_email_key UNIQUE (email);


--
-- Name: blocked_emails blocked_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_emails
    ADD CONSTRAINT blocked_emails_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: loans loans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_blocked_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_emails_email ON public.blocked_emails USING btree (email);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: bank_accounts bank_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: bank_transactions bank_transactions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;


--
-- Name: blocked_emails blocked_emails_blocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_emails
    ADD CONSTRAINT blocked_emails_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.profiles(id);


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: loans loans_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: loans loans_refund_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_refund_transaction_id_fkey FOREIGN KEY (refund_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: loans loans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loans
    ADD CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs Admins can create audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bank_accounts Admins can manage all bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all bank accounts" ON public.bank_accounts TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bank_transactions Admins can manage all bank transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all bank transactions" ON public.bank_transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can manage all categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all categories" ON public.categories TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: loans Admins can manage all loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all loans" ON public.loans TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notes Admins can manage all notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all notes" ON public.notes TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can manage all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all profiles" ON public.profiles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: transactions Admins can manage all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all transactions" ON public.transactions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: blocked_emails Admins can manage blocked emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage blocked emails" ON public.blocked_emails USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bank_accounts Approved users can create bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_transactions Approved users can create bank transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create bank transactions" ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (((bank_account_id IN ( SELECT bank_accounts.id
   FROM public.bank_accounts
  WHERE (bank_accounts.user_id = auth.uid()))) AND public.is_approved(auth.uid())));


--
-- Name: categories Approved users can create categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: loans Approved users can create loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create loans" ON public.loans FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: notes Approved users can create notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: transactions Approved users can create transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_accounts Approved users can delete their own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own bank accounts" ON public.bank_accounts FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_transactions Approved users can delete their own bank transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own bank transactions" ON public.bank_transactions FOR DELETE TO authenticated USING (((bank_account_id IN ( SELECT bank_accounts.id
   FROM public.bank_accounts
  WHERE (bank_accounts.user_id = auth.uid()))) AND public.is_approved(auth.uid())));


--
-- Name: categories Approved users can delete their own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own categories" ON public.categories FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: loans Approved users can delete their own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own loans" ON public.loans FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: notes Approved users can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own notes" ON public.notes FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: transactions Approved users can delete their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can delete their own transactions" ON public.transactions FOR DELETE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_accounts Approved users can update their own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_transactions Approved users can update their own bank transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own bank transactions" ON public.bank_transactions FOR UPDATE TO authenticated USING (((bank_account_id IN ( SELECT bank_accounts.id
   FROM public.bank_accounts
  WHERE (bank_accounts.user_id = auth.uid()))) AND public.is_approved(auth.uid())));


--
-- Name: categories Approved users can update their own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own categories" ON public.categories FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: loans Approved users can update their own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own loans" ON public.loans FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: notes Approved users can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own notes" ON public.notes FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: transactions Approved users can update their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can update their own transactions" ON public.transactions FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_accounts Approved users can view their own bank accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: bank_transactions Approved users can view their own bank transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own bank transactions" ON public.bank_transactions FOR SELECT TO authenticated USING (((bank_account_id IN ( SELECT bank_accounts.id
   FROM public.bank_accounts
  WHERE (bank_accounts.user_id = auth.uid()))) AND public.is_approved(auth.uid())));


--
-- Name: categories Approved users can view their own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own categories" ON public.categories FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: loans Approved users can view their own loans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own loans" ON public.loans FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: notes Approved users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own notes" ON public.notes FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: transactions Approved users can view their own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Approved users can view their own transactions" ON public.transactions FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.is_approved(auth.uid())));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: loans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


