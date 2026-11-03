// Everything sold through the site. The key is stamped on each order we create, so
// a paid order unlocks only its own kit, and an order for anything else on the same
// Razorpay account unlocks nothing. `prefix` names the product's Redis keys.
const PRODUCTS = {
  'delivery-cockpit': {
    prefix: 'cockpit',
    label: 'Delivery Cockpit kit',
    fileName: 'Delivery-Cockpit-Kit.zip',
    downloadEvent: 'cockpit_download',
    localPathEnv: 'KIT_LOCAL_PATH',
  },
  'job-email-skill': {
    prefix: 'job-email',
    label: 'Claude skill for Job emails',
    fileName: 'Job-Email-Skill.zip',
    downloadEvent: 'job_email_download',
    localPathEnv: 'JOB_EMAIL_LOCAL_PATH',
  },
};

export const DEFAULT_PRODUCT = 'delivery-cockpit';

// Ids come from the browser and from order notes, so only own keys count.
export function getProduct(id) {
  return typeof id === 'string' && Object.hasOwn(PRODUCTS, id) ? PRODUCTS[id] : null;
}

// Local development only: where to read a product's zip from disk instead of Redis.
export function localKitPath(product) {
  return process.env.NODE_ENV !== 'production' ? process.env[product.localPathEnv] : '';
}

export function razorpayFetch(path, init = {}) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', ...init.headers },
  });
}
