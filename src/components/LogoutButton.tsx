"use client";

export default function LogoutButton(props: { className?: string; label?: string }) {
  const { className, label = "Odjava" } = props;
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className={className ?? "w-full rounded border px-3 py-2 text-sm hover:bg-gray-50"}
        title="Odjava"
      >
        {label}
      </button>
    </form>
  );
}

