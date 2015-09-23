import RedisStore from './RedisStore';

export default function (config) {
  return new RedisStore(config);
}
