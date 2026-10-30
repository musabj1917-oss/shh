import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Haiku Admin Console',description:'Private, audited administration for Haiku Messenger.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
