import './oatmeal.css';
import DemoGrading from './DemoGrading';

/** Standalone /demo page: the real judge scoring screen on an in-memory backend. */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-taupe-100 font-sans antialiased">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <a href="/" className="font-display text-2xl text-taupe-950">Ubayy.</a>
        <a href="/" className="text-sm text-taupe-600 hover:text-taupe-950">← Back to home</a>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <DemoGrading />
      </div>
    </div>
  );
}
