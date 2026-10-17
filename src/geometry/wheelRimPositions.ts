/** Shared lateral positions of the four wheel rims in the truck Z axis. */
export interface WheelRimZPositions {
  leftOuterZ: number
  leftInnerZ: number
  rightInnerZ: number
  rightOuterZ: number
}

export interface WheelAxleZPositions {
  leftZ: number
  rightZ: number
}

export function computeWheelAxleZPositions(trackWidth: number): WheelAxleZPositions {
  return {
    leftZ: -trackWidth / 2,
    rightZ: trackWidth / 2,
  }
}

export function computeWheelRimZPositions(
  trackWidth: number,
  wheelOffset: number,
  wheelWidth: number,
): WheelRimZPositions {
  const leftWheelCenterZ = -(trackWidth / 2 + wheelOffset)
  const rightWheelCenterZ = trackWidth / 2 + wheelOffset
  const halfWheelWidth = wheelWidth / 2

  return {
    leftOuterZ: leftWheelCenterZ - halfWheelWidth,
    leftInnerZ: leftWheelCenterZ + halfWheelWidth,
    rightInnerZ: rightWheelCenterZ - halfWheelWidth,
    rightOuterZ: rightWheelCenterZ + halfWheelWidth,
  }
}
