export const groups = [
  { id: 'windows-both', name: 'Ramen binnen & buiten', short: 'Binnen & buiten', description: 'Eén tarief voor de volledige reiniging' },
  { id: 'windows-outside', name: 'Ramen enkel buiten', short: 'Enkel buiten', description: 'Raam en kader, aan de buitenzijde' },
  { id: 'shutters', name: 'Rolluiken', short: 'Rolluiken', description: 'Reiniging per volledig rolluik' },
  { id: 'garages', name: 'Garagepoorten', short: 'Garagepoorten', description: 'Reiniging per volledige poort' },
  { id: 'conservatories', name: 'Veranda’s & glazen tuinhuizen', short: 'Veranda’s', description: 'Reiniging per volledig object, inclusief glas' },
] as const

export type GroupId = typeof groups[number]['id']
export const windowTypes = ['Klein raam', 'Normaal raam', 'Groot raam', 'Schuifraam', 'Dakraam']
export const catalog = [
  ...['windows-both', 'windows-outside'].flatMap(group => windowTypes.map((name, i) => ({ id: `${group}-${i}`, group: group as GroupId, name }))),
  ...['Klein rolluik', 'Standaard rolluik', 'Groot rolluik'].map((name, i) => ({ id: `shutters-${i}`, group: 'shutters' as GroupId, name })),
  ...['Standaard garagepoort', 'Brede garagepoort', 'Grote / dubbele garagepoort'].map((name, i) => ({ id: `garages-${i}`, group: 'garages' as GroupId, name })),
  ...['Veranda — klein', 'Veranda — middelgroot', 'Veranda — groot', 'Glazen tuinhuis — klein', 'Glazen tuinhuis — middelgroot', 'Glazen tuinhuis — groot'].map((name, i) => ({ id: `conservatories-${i}`, group: 'conservatories' as GroupId, name })),
]
export const difficultyOptions = ['Normaal', 'Gemiddeld', 'Moeilijk', 'Zeer moeilijk']
export const accessOptions = ['Gelijkvloers / eenvoudig', 'Eerste verdieping', 'Tweede verdieping', 'Moeilijk bereikbaar']
export const frequencyOptions = ['Eenmalig', 'Maandelijks', 'Om de twee maanden', 'Per kwartaal', 'Halfjaarlijks', 'Jaarlijks']
