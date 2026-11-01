import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={
  title:'Haiku Admin Console',
  description:'Private, audited administration for Haiku Messenger.',
  icons:{icon:'/logo.svg',apple:'/logo.svg'}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
