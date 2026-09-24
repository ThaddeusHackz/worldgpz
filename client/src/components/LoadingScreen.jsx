import { Brand } from "./Brand.jsx";

export default function LoadingScreen({
  label = "Establishing orbital uplink",
}) {
  return (
    <div className="loading-screen">
      <Brand />
      <div className="loading-track" aria-hidden="true">
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}
