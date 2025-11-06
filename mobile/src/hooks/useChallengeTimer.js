import { useEffect, useRef, useState } from 'react';

const useChallengeTimer = (initialTime = 60) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    if (timeLeft <= 0) {
      setIsActive(false);
      return;
    }

    timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);

    return () => clearTimeout(timerRef.current);
  }, [isActive, timeLeft]);

  const startTimer = () => {
    setIsActive(true);
    setTimeLeft(initialTime);
  };

  const stopTimer = () => {
    setIsActive(false);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(initialTime);
  };

  return { timeLeft, isActive, startTimer, stopTimer, resetTimer };
};

export default useChallengeTimer;