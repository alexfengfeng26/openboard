'use client'

import { memo } from 'react'

const PEOPLE = [
  { name: 'dev', lane: 0, delay: '0s', label: '开发中' },
  { name: 'review', lane: 1, delay: '-2.4s', label: '评审中' },
  { name: 'bot', lane: 2, delay: '-4.8s', label: '测试中' },
  { name: 'ops', lane: 3, delay: '-7.2s', label: '监控中' },
]

export const PixelOfficeScene = memo(function PixelOfficeScene() {
  return (
    <div className="pixel-office-scene" aria-hidden="true">
      <div className="pixel-office-wall">
        <span className="pixel-office-poster poster-a" />
        <span className="pixel-office-poster poster-b" />
        <span className="pixel-office-poster poster-c" />
        <span className="pixel-office-clock" />
      </div>
      <div className="pixel-office-floor" />
      <div className="pixel-office-cable" />

      <div className="pixel-office-props">
        <span className="pixel-office-plant plant-a" />
        <span className="pixel-office-plant plant-b" />
        <span className="pixel-office-rack rack-a" />
        <span className="pixel-office-rack rack-b" />
        <span className="pixel-office-desk desk-a" />
        <span className="pixel-office-desk desk-b" />
      </div>

      {PEOPLE.map((person) => (
        <span
          key={person.name}
          className={`pixel-office-worker pixel-office-worker-${person.name}`}
          style={{ ['--worker-lane' as string]: person.lane, ['--worker-delay' as string]: person.delay }}
        >
          <span className="pixel-office-bubble">{person.label}</span>
          <span className="pixel-office-head" />
          <span className="pixel-office-body" />
          <span className="pixel-office-arm arm-left" />
          <span className="pixel-office-arm arm-right" />
          <span className="pixel-office-leg leg-left" />
          <span className="pixel-office-leg leg-right" />
        </span>
      ))}

      <span className="pixel-office-spark spark-a" />
      <span className="pixel-office-spark spark-b" />
      <span className="pixel-office-spark spark-c" />
    </div>
  )
})
