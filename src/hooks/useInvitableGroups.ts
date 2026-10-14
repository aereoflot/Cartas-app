import { useQuery } from '@tanstack/react-query'
import { listGroups } from '@/lib/groups'
import { useFriendGroups } from './usePrefs'
import { useSession } from './useSession'

export interface InvitableGroup {
  id: string
  name: string
  memberNames: string[]
}

/**
 * The groups you can invite to a match, from wherever they live: the account
 * when you are signed in, this device when you are not. The match-setup screen
 * should not have to care which.
 */
export function useInvitableGroups(): InvitableGroup[] {
  const { session } = useSession()
  const signedIn = session !== null

  const local = useFriendGroups()
  const cloud = useQuery({ queryKey: ['groups'], queryFn: listGroups, enabled: signedIn })

  if (!signedIn) {
    return local.map((group) => ({
      id: group.id,
      name: group.name,
      memberNames: group.members,
    }))
  }

  return (cloud.data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    memberNames: group.members.map((member) => member.name).filter((name) => name !== ''),
  }))
}
