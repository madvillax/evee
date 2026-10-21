import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";

export const metadata = { title: "Create workspace" };

export default function SignUpPage() {
  return <AuthLayout title="Create your workspace" subtitle="Start with a business profile, then choose the public sources you want to monitor."><AuthForm mode="sign-up" /></AuthLayout>;
}
