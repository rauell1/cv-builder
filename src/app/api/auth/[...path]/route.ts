export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth/server';

export const { GET, POST } = auth.handler();
