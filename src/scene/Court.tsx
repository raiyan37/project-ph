import {
  CENTER_MARK_LENGTH,
  COURT_LINE_WIDTH,
  DOUBLES_HALF_WIDTH,
  HALF_LENGTH,
  SERVICE_LINE_DISTANCE,
  SINGLES_HALF_WIDTH,
  centerMarkCenterZ,
  centerMarkWidthX,
} from '../lib/tennis/court';

const COURT_COLOR = '#1b4332';
const LINE_COLOR = '#f8f8f6';
const APRON_COLOR = '#141414';

const LINE_WIDTH = COURT_LINE_WIDTH;
const LINE_THICKNESS = 0.002;
const SURFACE_Y = 0;
const LINE_Y = SURFACE_Y + LINE_THICKNESS / 2 + 0.001;

const APRON_MARGIN = 4;
const COURT_WIDTH = DOUBLES_HALF_WIDTH * 2;
const COURT_LENGTH = HALF_LENGTH * 2;
const APRON_WIDTH = COURT_WIDTH + APRON_MARGIN * 2;
const APRON_LENGTH = COURT_LENGTH + APRON_MARGIN * 2;

interface CourtLineProps {
  name: string;
  position: [number, number, number];
  size: [number, number, number];
}

function CourtLine({ name, position, size }: CourtLineProps) {
  return (
    <mesh name={name} position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={LINE_COLOR} />
    </mesh>
  );
}

export interface CourtProps {
  /** Lateral/longitudinal offset for the whole court group. */
  position?: [number, number, number];
}

export function Court({ position = [0, 0, 0] }: CourtProps) {
  return (
    <group name="court" position={position}>
      <mesh name="court-apron" position={[0, SURFACE_Y - 0.003, 0]}>
        <boxGeometry args={[APRON_WIDTH, 0.006, APRON_LENGTH]} />
        <meshStandardMaterial color={APRON_COLOR} roughness={0.95} />
      </mesh>

      <mesh name="court-surface" position={[0, SURFACE_Y, 0]}>
        <boxGeometry args={[COURT_WIDTH, 0.004, COURT_LENGTH]} />
        <meshStandardMaterial color={COURT_COLOR} roughness={0.85} />
      </mesh>

      <group name="court-lines">
        <CourtLine
          name="baseline-near"
          position={[0, LINE_Y, -HALF_LENGTH]}
          size={[COURT_WIDTH, LINE_THICKNESS, LINE_WIDTH]}
        />
        <CourtLine
          name="baseline-far"
          position={[0, LINE_Y, HALF_LENGTH]}
          size={[COURT_WIDTH, LINE_THICKNESS, LINE_WIDTH]}
        />

        <CourtLine
          name="doubles-sideline-near"
          position={[-DOUBLES_HALF_WIDTH, LINE_Y, 0]}
          size={[LINE_WIDTH, LINE_THICKNESS, COURT_LENGTH]}
        />
        <CourtLine
          name="doubles-sideline-far"
          position={[DOUBLES_HALF_WIDTH, LINE_Y, 0]}
          size={[LINE_WIDTH, LINE_THICKNESS, COURT_LENGTH]}
        />

        <CourtLine
          name="singles-sideline-near"
          position={[-SINGLES_HALF_WIDTH, LINE_Y, 0]}
          size={[LINE_WIDTH, LINE_THICKNESS, COURT_LENGTH]}
        />
        <CourtLine
          name="singles-sideline-far"
          position={[SINGLES_HALF_WIDTH, LINE_Y, 0]}
          size={[LINE_WIDTH, LINE_THICKNESS, COURT_LENGTH]}
        />

        <CourtLine
          name="service-line-near"
          position={[0, LINE_Y, -SERVICE_LINE_DISTANCE]}
          size={[SINGLES_HALF_WIDTH * 2, LINE_THICKNESS, LINE_WIDTH]}
        />
        <CourtLine
          name="service-line-far"
          position={[0, LINE_Y, SERVICE_LINE_DISTANCE]}
          size={[SINGLES_HALF_WIDTH * 2, LINE_THICKNESS, LINE_WIDTH]}
        />

        <CourtLine
          name="center-service-line-near"
          position={[0, LINE_Y, -SERVICE_LINE_DISTANCE / 2]}
          size={[LINE_WIDTH, LINE_THICKNESS, SERVICE_LINE_DISTANCE]}
        />
        <CourtLine
          name="center-service-line-far"
          position={[0, LINE_Y, SERVICE_LINE_DISTANCE / 2]}
          size={[LINE_WIDTH, LINE_THICKNESS, SERVICE_LINE_DISTANCE]}
        />

        <CourtLine
          name="center-mark-near"
          position={[0, LINE_Y, centerMarkCenterZ('near')]}
          size={[centerMarkWidthX(), LINE_THICKNESS, CENTER_MARK_LENGTH]}
        />
        <CourtLine
          name="center-mark-far"
          position={[0, LINE_Y, centerMarkCenterZ('far')]}
          size={[centerMarkWidthX(), LINE_THICKNESS, CENTER_MARK_LENGTH]}
        />
      </group>
    </group>
  );
}
