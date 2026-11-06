import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={
  title:'Haiku Admin Console',
  description:'Private, audited administration for Haiku Messenger.',
  icons:{icon:[{url:'/logo.svg?v=2',type:'image/svg+xml'},{url:'/favicon.ico?v=2',sizes:'any'}],apple:'/logo.png?v=2'}
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
