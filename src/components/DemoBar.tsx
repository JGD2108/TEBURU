'use client';

import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { isLocalDemo, type DemoRole } from '@/lib/demo';

const links: { role: DemoRole; href: string; label: string }[] = [
  { role: 'platform', href: '/platform?demo=platform', label: 'Plataforma' },
  { role: 'admin', href: '/admin?demo=admin', label: 'Admin' },
  { role: 'waiter', href: '/admin?demo=waiter', label: 'Mesero' },
  { role: 'kitchen', href: '/admin?demo=kitchen', label: 'Cocina' },
  { role: 'guest', href: '/t/demo-table?demo=guest', label: 'Comensal' },
];

export default function DemoBar({ active }: { active?: DemoRole }) {
  if (!isLocalDemo()) return null;
  return <aside style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '9px max(18px, calc((100vw - 1200px) / 2))', background: '#24201c', color: '#fffaf1', fontFamily: 'ui-monospace, monospace', fontSize: '.74rem' }}>
    <FlaskConical size={15} /> DEMO LOCAL
    {links.map((link) => <Link key={link.role} href={link.href} style={{ color: active === link.role ? '#f6c75a' : '#fffaf1', textDecoration: 'none', padding: '5px 8px', borderBottom: active === link.role ? '1px solid #f6c75a' : '1px solid transparent' }}>{link.label}</Link>)}
  </aside>;
}
