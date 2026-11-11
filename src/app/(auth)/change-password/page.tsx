import { redirect } from "next/navigation";

export default function ChangePasswordPage() {
  redirect("/update-password?mandatory=true");
}
