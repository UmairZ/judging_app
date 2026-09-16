import { useGradingSession, type GradingScreenProps } from './useGradingSession';
import { useIsPhone } from './useIsPhone';
import DesktopShell from './grading/DesktopShell';
import MobileShell from './grading/MobileShell';

export type { GradingScreenProps };
export default function GradingScreen(props: GradingScreenProps) {
  const session = useGradingSession(props);
  const phone = useIsPhone();
  return phone ? <MobileShell {...props} s={session} /> : <DesktopShell {...props} s={session} />;
}
