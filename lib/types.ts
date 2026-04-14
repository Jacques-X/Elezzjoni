export interface Party {
  id: string
  name: string
  abbreviation: string
  color_hex: string
  logo_url: string | null
}

export interface District {
  id: number
  name: string
  localities: string[]
}

export interface Candidate {
  id: string
  full_name: string
  party_id: string
  districts: number[]
  photo_url: string | null
  personal_stances: string[] | null
  key_quotes: string[] | null
  social_links: {
    facebook?: string
    instagram?: string
    website?: string
  } | null
  incumbent: boolean
  last_updated: string
  // Joined fields
  party?: Party
}

export interface CandidateWithParty extends Candidate {
  party: Party
}
