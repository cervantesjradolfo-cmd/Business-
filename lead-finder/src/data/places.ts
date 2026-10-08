// Ready-made place lists for "Many places" searches. Edit freely: each entry is searched as typed.

export const LARGEST_US_CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX',
  'San Diego, CA', 'Dallas, TX', 'Jacksonville, FL', 'Austin, TX', 'Fort Worth, TX', 'San Jose, CA', 'Columbus, OH',
  'Charlotte, NC', 'Indianapolis, IN', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'Oklahoma City, OK',
  'Nashville, TN', 'Washington, DC', 'El Paso, TX', 'Las Vegas, NV', 'Boston, MA', 'Detroit, MI', 'Portland, OR',
  'Louisville, KY', 'Memphis, TN', 'Baltimore, MD', 'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA',
  'Sacramento, CA', 'Mesa, AZ', 'Atlanta, GA', 'Kansas City, MO', 'Colorado Springs, CO', 'Omaha, NE', 'Raleigh, NC',
  'Miami, FL', 'Virginia Beach, VA', 'Long Beach, CA', 'Oakland, CA', 'Minneapolis, MN', 'Bakersfield, CA', 'Tulsa, OK',
  'Tampa, FL', 'Arlington, TX',
]

// Each state's larger cities (and DC).
export const STATE_CITIES: { code: string; name: string; cities: string[] }[] = [
  { code: 'AL', name: 'Alabama', cities: ['Huntsville', 'Birmingham', 'Montgomery', 'Mobile', 'Tuscaloosa'] },
  { code: 'AK', name: 'Alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Wasilla', 'Sitka'] },
  { code: 'AZ', name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Gilbert'] },
  { code: 'AR', name: 'Arkansas', cities: ['Little Rock', 'Fayetteville', 'Fort Smith', 'Springdale', 'Jonesboro'] },
  { code: 'CA', name: 'California', cities: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno'] },
  { code: 'CO', name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'] },
  { code: 'CT', name: 'Connecticut', cities: ['Bridgeport', 'Stamford', 'New Haven', 'Hartford', 'Waterbury'] },
  { code: 'DE', name: 'Delaware', cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna'] },
  { code: 'DC', name: 'District of Columbia', cities: ['Washington'] },
  { code: 'FL', name: 'Florida', cities: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg'] },
  { code: 'GA', name: 'Georgia', cities: ['Atlanta', 'Columbus', 'Augusta', 'Macon', 'Savannah'] },
  { code: 'HI', name: 'Hawaii', cities: ['Honolulu', 'Hilo', 'Kailua', 'Kapolei', 'Kahului'] },
  { code: 'ID', name: 'Idaho', cities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'] },
  { code: 'IL', name: 'Illinois', cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford'] },
  { code: 'IN', name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'] },
  { code: 'IA', name: 'Iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'] },
  { code: 'KS', name: 'Kansas', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'] },
  { code: 'KY', name: 'Kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'] },
  { code: 'LA', name: 'Louisiana', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'] },
  { code: 'ME', name: 'Maine', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'] },
  { code: 'MD', name: 'Maryland', cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Annapolis'] },
  { code: 'MA', name: 'Massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell'] },
  { code: 'MI', name: 'Michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'] },
  { code: 'MN', name: 'Minnesota', cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'] },
  { code: 'MS', name: 'Mississippi', cities: ['Jackson', 'Gulfport', 'Southaven', 'Biloxi', 'Hattiesburg'] },
  { code: 'MO', name: 'Missouri', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'] },
  { code: 'MT', name: 'Montana', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'] },
  { code: 'NE', name: 'Nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'] },
  { code: 'NV', name: 'Nevada', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'] },
  { code: 'NH', name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord', 'Dover', 'Rochester'] },
  { code: 'NJ', name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton'] },
  { code: 'NM', name: 'New Mexico', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'] },
  { code: 'NY', name: 'New York', cities: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse'] },
  { code: 'NC', name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'] },
  { code: 'ND', name: 'North Dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'] },
  { code: 'OH', name: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'] },
  { code: 'OK', name: 'Oklahoma', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'] },
  { code: 'OR', name: 'Oregon', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro'] },
  { code: 'PA', name: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie'] },
  { code: 'RI', name: 'Rhode Island', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'] },
  { code: 'SC', name: 'South Carolina', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'] },
  { code: 'SD', name: 'South Dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'] },
  { code: 'TN', name: 'Tennessee', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'] },
  { code: 'TX', name: 'Texas', cities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth'] },
  { code: 'UT', name: 'Utah', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'] },
  { code: 'VT', name: 'Vermont', cities: ['Burlington', 'South Burlington', 'Rutland', 'Essex Junction', 'Barre'] },
  { code: 'VA', name: 'Virginia', cities: ['Virginia Beach', 'Chesapeake', 'Norfolk', 'Richmond', 'Arlington'] },
  { code: 'WA', name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'] },
  { code: 'WV', name: 'West Virginia', cities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'] },
  { code: 'WI', name: 'Wisconsin', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'] },
  { code: 'WY', name: 'Wyoming', cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'] },
]

export const MAX_PLACES = 100

// One place per line (or separated by ";"), trimmed, duplicates dropped (ignoring case), capped.
export function parsePlaces(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/[\n;]/)) {
    const p = raw.trim().replace(/\s+/g, ' ').slice(0, 200)
    const key = p.toLowerCase()
    if (!p || seen.has(key)) continue
    seen.add(key)
    out.push(p)
    if (out.length === MAX_PLACES) break
  }
  return out
}

export function stateCities(code: string): string[] {
  const s = STATE_CITIES.find((x) => x.code === code)
  return s ? s.cities.map((c) => `${c}, ${s.code}`) : []
}
