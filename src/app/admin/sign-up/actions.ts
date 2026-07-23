'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  // Only the configured admin email is allowed to create an account here -
  // this page has no link anywhere in the site, but it's still a public
  // URL, so this keeps it from becoming an open sign-up form for anyone
  // who finds it.
  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (adminEmail && email.toLowerCase() !== adminEmail.toLowerCase()) {
    return { error: 'This account creation form is restricted.' };
  }

  const { error } = await auth.signUp.email({ email, password, name });

  if (error) {
    return { error: error.message || 'Failed to create account' };
  }

  redirect('/admin');
}
