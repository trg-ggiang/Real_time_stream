import { ProfileForm } from "../profile/ProfileForm";
export function PersonalProfile({
  token,
  autoContinue,
  onContinue,
  onLogout,
}: {
  token: string;
  autoContinue: boolean;
  onContinue: () => void;
  onLogout: () => void;
}) {
  return (
    <main className="pf-screen">
      <ProfileForm
        token={token}
        onboarding
        autoContinue={autoContinue}
        onComplete={onContinue}
        onLogout={onLogout}
      />
    </main>
  );
}
