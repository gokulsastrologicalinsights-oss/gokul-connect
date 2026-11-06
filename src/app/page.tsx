import { redirect } from "next/navigation";

export default function RootPage() {
  // Direct users straight into the Business Selection hub
  redirect("/select-business");
}
