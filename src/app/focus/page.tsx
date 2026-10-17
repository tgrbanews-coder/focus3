import type { Metadata } from "next";
import { FocusScreen } from "@/components/FocusScreen";

export const metadata: Metadata = {
  title: "تركيز — Focus 3",
};

export default function FocusPage() {
  return <FocusScreen />;
}
