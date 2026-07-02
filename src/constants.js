export const SK='ipon-v5';
export const GK='ipon-gkey';
export const BK='ipon-balance-hidden';
export const SCHEMA_VERSION=2;
export const APP_VERSION='1.2.8';
export const SUPABASE_URL='https://qrcvsuujzbxngvucrldn.supabase.co';
export const SUPABASE_KEY='sb_publishable_NNXUPePLmz3bxB9k6C-oew_I9zHapFM';
export const LIVE_SYNC_TABLE='budget_records';
export const LIVE_COLLECTIONS=['transactions','homeExpenses','priceItems','stocks','bills','airconUsage','tvUsage','appliances','applianceUsage','activeSessions'];
export const PROFILE_VAL_KEYS=['balance','balanceBase'];
export const LIVE_PENDING_KEY=SK+'-pending-v1';
export const MODELS=['gemini-2.5-flash-lite','gemini-2.5-flash','gemini-2.0-flash-lite','gemini-2.0-flash','gemini-1.5-flash-8b','gemini-1.5-flash'];
export const SCAN_PROMPT=`Analyze this image from the Philippines. It may be a receipt, order-details screenshot, price tag, shelf label, palengke sign, or menu.

Extract every visible purchasable line item with a Philippine Peso price. For shopping/order screenshots, match the product name on the left/center with its quantity and price on the right. If a quantity like x30 appears beside a line, return qty:30 and keep price as the visible unit price for one item. The app will compute the total as qty * price.

Return ONLY a raw JSON array, no markdown:
[{"name":"item","price":45.00,"qty":1,"unit":"kg/pcs/pack/etc","store":"infer or Unknown","category":"Food or Home","subcat":"Ulam (Viand) or Vegetables or Rice & Grains or Snacks or Drinks or Condiments & Sauces or Cleaning Supplies or Toiletries & Personal Care or Laundry or Kitchen Supplies or Medicine & First Aid or Others","note":"optional"}]

If no prices found, return: []`;
export const FSRC=['Carinderia','Groceries','Palengke','Home-cooked','Grab/Delivery','Fast Food','Restaurant','Sari-sari store','Others'];
export const STORES=['Palengke','Supermarket','Puregold','SM Savemore','Robinsons','Shopee/Lazada','Sari-sari','Others'];
export const FCATS=['Ulam (Viand)','Vegetables','Rice & Grains','Snacks','Drinks','Condiments & Sauces','Others'];
export const HCATS=['Cleaning Supplies','Toiletries & Personal Care','Laundry','Kitchen Supplies','Bedding & Linen','Medicine & First Aid','Others'];
export const SCATS=['Food Staples','Cleaning','Toiletries','Medicine','Condiments','Kitchen','Others'];
export const UNITS=['pcs','kg','g','pack','can','bottle','bundle','sachet','box','litre','roll','pair','tali'];
export const APPLIANCE_CATS=['Cooling','Kitchen','Network','Security','Computer','Chargers','Lighting','Laundry','Others'];
export const DEFAULT_AIRCON_RATES={startup:1.20,sleepDay:0.62,sleepNight:0.48,ecoDay:0.55,ecoNight:0.42,day:0.85,night:0.58};
export const AIRCON_MODES=['Sleep','Eco','Normal'];
export const AIRCON_MODEL_PROFILE={model:'Carrier 42CEA012308',outdoorModel:'38CEA012308',coolingKw:3.33,ratedWatts:1200,minWatts:200,maxWatts:1300,cspf:4.3,doeMonthlyKwh:162};
export const DEFAULT_WEATHER={provider:'open-meteo',label:'',lat:'',lon:'',elevation:'',apiKey:''};
export const LABEL_DEFAULTS={foodSources:FSRC,homeCategories:HCATS,homeStores:STORES,applianceCategories:APPLIANCE_CATS};
export const DEFAULT_APPLIANCES=[];

export const TABS=[{id:'dash',icon:'overview',label:'Home'},{id:'food',icon:'food',label:'Food'},{id:'home',icon:'home',label:'Home'},{id:'bills',icon:'bills',label:'Bills'},{id:'aircon',icon:'electric',label:'Electric'},{id:'scan',icon:'scan',label:'Scan'}];
export const SCREEN_LABELS={dash:'Overview',food:'Food Expenses',home:'Home & Toiletries',bills:'Bills',prices:'Price Comparison',scan:'AI Scanner',reports:'Reports',stocks:'Pantry & Stocks',aircon:'Electricity Usage',appliances:'Appliance Manager',lists:'Lists & Defaults'};

// Keys that are truly global and should be stored in meta|settings
export const GLOBAL_SETTINGS_KEYS = [
  'profiles', 'activeProfileId',
  'meralcoRate', 'meralcoReadDay', 'monthlyRates',
  'airconStartupRate', 'airconSleepDayRate', 'airconSleepNightRate',
  'airconEcoDayRate', 'airconEcoNightRate', 'airconDayRate', 'airconNightRate',
  'airconDefaultSleepMode', 'airconDefaultMode', 'airconDefaultTemp',
  'airconModel', 'airconTempBaseline', 'airconTempStepPct', 'airconOutdoorBaseline',
  'airconOutdoorStepPct', 'airconOutdoorModel', 'airconCoolingKw', 'airconRatedWatts',
  'airconMinWatts', 'airconMaxWatts', 'airconCspf', 'airconDoeMonthlyKwh',
  'weatherProvider', 'weatherLabel', 'weatherLat', 'weatherLon', 'weatherElevation',
  'weatherApiKey', 'weather', // weather itself is global state
  'labels', // custom labels
  'tvModel', 'tvWatts',
  'dailyBudget', 'groceryBudget', // budgets are global settings
  'stockAlertDismissed', // global flag
  'theme', 'darkMode', // theme settings
  // Text scaling (global UI accessibility)
  'textScaleHeading', 'textScaleSubtitle', 'textScaleBody'
];
