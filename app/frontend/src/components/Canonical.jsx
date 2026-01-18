import { useLocation } from "react-router-dom";

const CANONICAL_ORIGIN = "https://www.pwndep0t.com";

export default function Canonical() {
  const { pathname } = useLocation();
  const href = `${CANONICAL_ORIGIN}${pathname}`;
  return <link rel="canonical" href={href} />;
}