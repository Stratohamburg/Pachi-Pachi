import { useEffect, useRef, useState } from 'react';

interface PowerLauncherProps {
  disabled: boolean;
  holdSpaceToCharge: boolean;
  onLaunch: (power: number) => void;
}

export function PowerLauncher(props: PowerLauncherProps) {
  const [power, setPower] = useState(0.54);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const powerRef = useRef(power);
  const draggingRef = useRef(false);
  const chargeDirectionRef = useRef(-1);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    powerRef.current = power;
  }, [power]);

  useEffect(() => {
    if (!props.holdSpaceToCharge) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || props.disabled || intervalRef.current !== null) {
        return;
      }

      event.preventDefault();
      intervalRef.current = window.setInterval(() => {
        setPower((current) => {
          const next = current + chargeDirectionRef.current * 0.03;
          if (next <= 0.06 || next >= 0.98) {
            chargeDirectionRef.current *= -1;
          }
          return Math.min(0.98, Math.max(0.06, next));
        });
      }, 24);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }

      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (!props.disabled) {
          props.onLaunch(powerRef.current);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [props]);

  const updateFromClientY = (clientY: number) => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const ratio = 1 - (clientY - rect.top) / rect.height;
    setPower(Math.min(0.98, Math.max(0.06, ratio)));
  };

  return (
    <div
      ref={hostRef}
      className={`launcher ${props.disabled ? 'is-disabled' : ''}`}
      onPointerDown={(event) => {
        if (props.disabled) {
          return;
        }

        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientY(event.clientY);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current || props.disabled) {
          return;
        }

        updateFromClientY(event.clientY);
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) {
          return;
        }

        draggingRef.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        props.onLaunch(powerRef.current);
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <div className="launcher__scale">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={`launcher__tick ${index >= 10 ? 'is-perfect' : ''}`} />
        ))}
      </div>
      <div className="launcher__track">
        <div className="launcher__fill" style={{ height: `${power * 100}%` }} />
        <div className="launcher__knob" style={{ bottom: `calc(${power * 100}% - 24px)` }} />
      </div>
      <div className="launcher__labels">
        <span>Perfect</span>
        <strong>{Math.round(power * 100)}%</strong>
      </div>
    </div>
  );
}