import { Brand } from "./Brand.jsx";

export default function LoadingScreen({
  label = "Synchronizing global sources",
}) {
  return (
    <div className="loading-screen">
      <Brand />
      <div className="loading-track">
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}
