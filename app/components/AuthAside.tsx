import Image from "next/image";

export default function AuthAside() {
  return <aside className="kh-auth-aside">
    <Image src="/mainheroIMG.png" alt="Tayo ang lakas! A Filipino superhero in Saudi Arabia." width={1717} height={916} unoptimized />
    <div className="kh-auth-aside-copy"><p className="kh-eyebrow">ONE HUB. ONE KABAYAN FAMILY.</p><h2>Your next chapter<br />starts with community.</h2><p>Learn something new, make every riyal count, and connect with people who understand life away from home.</p></div>
  </aside>;
}
