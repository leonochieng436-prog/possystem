import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-foreground text-white p-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Duka<span className="text-primary">OS</span>
        </Link>
        <div className="max-w-sm">
          <p className="text-2xl font-medium leading-snug">
            One system for stock, sales, suppliers and profit &mdash; built
            for how Kenyan businesses actually run.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Products → Suppliers → Purchases → Inventory → Sales → Customers
            → Payments → Expenses → Profit, all connected.
          </p>
        </div>
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} DukaOS. Every business is an
          isolated tenant.
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
