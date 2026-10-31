import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '../lib/i18n';

// En Cloudflare Pages la raíz la redirige public/_redirects; esto cubre `next dev`.
export default function RootIndex() {
  redirect(`/${DEFAULT_LOCALE}`);
}
