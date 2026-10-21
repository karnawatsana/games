import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import SubmitFlow from "@/components/results/SubmitFlow";
import { productDate } from "@/lib/dates";

export default function P() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AppShell title={<>Add a <em className="serif" style={{ color: "var(--lime)", fontWeight: 400 }}>result.</em></>} eyebrow="Results"><SubmitFlow today={productDate()} username="sanakarnawat" mysteryName="Sample Game" /></AppShell>;
}
