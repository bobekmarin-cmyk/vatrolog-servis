import PlatformLoginForm from "./PlatformLoginForm";

export default function PlatformLoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm surface p-5 shadow-lg rounded-xl">
        <h1 className="text-xl font-bold">Platform prijava</h1>
        <p className="mt-0.5 text-sm text-slate-600">Ultra admin sučelje (vendor).</p>

        <div className="mt-4">
          <PlatformLoginForm />
        </div>
      </div>
    </main>
  );
}
