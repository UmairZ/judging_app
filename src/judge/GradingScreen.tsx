import { useGradingSession, type GradingScreenProps } from './useGradingSession';
import DesktopShell from './grading/DesktopShell';

export type { GradingScreenProps };
export default function GradingScreen(props: GradingScreenProps) {
  const session = useGradingSession(props);
  return <DesktopShell {...props} s={session} />;
}
