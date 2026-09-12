import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProcessingAnimation, ProcessingStatus } from '../components/processing/ProcessingAnimation';
import { AccessibilityToggle } from '../components/shared/AccessibilityToggle';
import '../components/processing/processing-glass.css';

const statusMessages = [
  'Reconstructing court geometry...',
  'Solving ball trajectories...',
  'Calibrating Hawk-Eye cameras...',
  'Synchronizing the broadcast clock...',
  'Locking player court-eye feeds...',
  'Court ready',
];

const MESSAGE_THRESHOLDS = [0, 15, 35, 55, 75, 95];
const DURATION = 30000;
const STORAGE_KEY = 'processing_start_time';

export function ProcessingPage() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number>(0);
  const messageIndex = Math.max(
    0,
    MESSAGE_THRESHOLDS.findIndex(
      (threshold, i) =>
        progress >= threshold &&
        (i === MESSAGE_THRESHOLDS.length - 1 ||
          progress < MESSAGE_THRESHOLDS[i + 1]!),
    ),
  );

  useEffect(() => {
    // Check if we have a stored start time, otherwise create one
    const storedStartTime = sessionStorage.getItem(`${STORAGE_KEY}_${gameId}`);
    if (storedStartTime) {
      startTimeRef.current = parseInt(storedStartTime, 10);
    } else {
      startTimeRef.current = Date.now();
      sessionStorage.setItem(`${STORAGE_KEY}_${gameId}`, startTimeRef.current.toString());
    }

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(newProgress);
    };

    // Update immediately
    updateProgress();

    // Then update every 50ms
    const progressInterval = setInterval(updateProgress, 50);

    return () => clearInterval(progressInterval);
  }, [gameId]);

  useEffect(() => {
    // Navigate to stream when complete
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        // Clear the stored start time
        sessionStorage.removeItem(`${STORAGE_KEY}_${gameId}`);
        navigate(`/stream/${gameId}`);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [progress, navigate, gameId]);

  return (
    <div className="processing-page" role="main" aria-label="Loading stream">
      {/* Full screen neural network background */}
      <div className="processing-canvas-wrapper" aria-hidden="true">
        <ProcessingAnimation />
      </div>

      {/* Centered content overlay */}
      <div className="processing-container">
        <div className="processing-content">
          <header className="processing-header">
            <div className="processing-brand">
              <span className="processing-brand-title">Project Horizon</span>
            </div>
          </header>

          <ProcessingStatus
            progress={progress}
            message={statusMessages[messageIndex]}
          />

          <p className="processing-hint" aria-live="polite">Preparing the Hawk-Eye court</p>
        </div>
      </div>

      <AccessibilityToggle />
    </div>
  );
}
