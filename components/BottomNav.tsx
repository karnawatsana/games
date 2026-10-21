"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, List, Compass, User } from "./Icons";

const items = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/groups", label: "Groups", Icon: Users },
  { href: "/results", label: "Results", Icon: List },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/profile", label: "Profile", Icon: User },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Primary">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" || path === "/preview" : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={active ? "active" : ""}>
              <Icon />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
