'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signOutAdmin() {
  await auth.signOut();
  redirect('/admin/sign-in');
}
