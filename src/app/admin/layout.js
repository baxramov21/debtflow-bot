import '../globals.css';

export const metadata = {
  title: 'DentFlow Bot Admin',
  description: 'Manage your DentFlow Telegram Bot',
};

export default function AdminLayout({ children }) {
  return (
    <div>
      <header className="layout-header">
        <h2>DentFlow Bot Admin</h2>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
