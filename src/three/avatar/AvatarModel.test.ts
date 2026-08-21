import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { firstAnimatedClip } from './AvatarModel'

/**
 * These pin the exact shapes the real asset files have, because the bug they
 * cover was invisible: the avatar simply stood still with its arms out, which
 * looked like a missing animation rather than the wrong one being chosen.
 */

function empty(name: string) {
  return new THREE.AnimationClip(name, 0, [])
}

function animated(name: string, duration = 9.93) {
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, duration], [0, 0, 0, 0, 0, 0]),
  ])
}

describe('firstAnimatedClip', () => {
  it('skips a leading empty stack', () => {
    // character.fbx: Take 001 with no tracks, then the real 9.93s idle.
    const clips = [empty('Take 001'), animated('mixamo.com')]
    expect(firstAnimatedClip(clips)?.name).toBe('mixamo.com')
  })

  it('takes the real clip when it comes first', () => {
    // hiphop.fbx and salsa.fbx are the other way round.
    const clips = [animated('mixamo.com', 17.23), empty('Take 001')]
    expect(firstAnimatedClip(clips)?.name).toBe('mixamo.com')
  })

  it('handles a file with only the real clip', () => {
    // house, robot, rumba, shuffle and uprock — downloaded animation-only.
    expect(firstAnimatedClip([animated('mixamo.com', 21.37)])?.name).toBe('mixamo.com')
  })

  it('returns undefined when every stack is empty', () => {
    expect(firstAnimatedClip([empty('Take 001'), empty('Take 002')])).toBeUndefined()
  })

  it('returns undefined for a file with no animation at all', () => {
    expect(firstAnimatedClip([])).toBeUndefined()
  })
})
