import React from 'react';
import TruckLoadingAnimation from '@/components/TruckLoadingAnimation';

/**
 * In-app loading indicator. Uses the branded truck/PDF animation instead of a
 * plain spinner (this component is used for short in-flow loading states, so
 * it does not need the onFinish callback the boot splash uses).
 */
export default function LoadingView({ label }: { label?: string }) {
  return <TruckLoadingAnimation label={label} />;
}
