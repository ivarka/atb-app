import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, '.local');
const sdk = process.env.ANDROID_HOME || path.join(local, 'android-sdk');
const java = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';
const env = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk,
  GRADLE_USER_HOME: path.join(local, 'gradle'), NODE_ENV: 'production' };
function run(cmd, args, cwd = root, extra = {}) {
  const result = spawnSync(cmd, args, { cwd, env: { ...env, ...extra }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(cmd)} failed (${result.status})`);
}
if (!existsSync(sdk)) throw new Error('Android SDK mangler. Sett ANDROID_HOME eller installer SDK i .local/android-sdk.');
if (!existsSync(path.join(java, 'bin', 'java'))) throw new Error('Sett JAVA_HOME til en installert JDK 17 eller nyere.');
mkdirSync(local, { recursive: true });
mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const passwordFile = path.join(local, 'android-signing-password');
const keystore = path.join(local, 'underveis.keystore');
if (existsSync(keystore) && !existsSync(passwordFile)) throw new Error('Signeringsnøkkel finnes, men passordfilen mangler. Gjenopprett den fra sikkerhetskopi.');
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
const password = readFileSync(passwordFile, 'utf8').trim();
const signing = { UNDERVEIS_KEYSTORE: keystore, UNDERVEIS_KEY_PASSWORD: password };
if (!existsSync(keystore)) {
  run(path.join(java, 'bin', 'keytool'), ['-genkeypair', '-noprompt', '-keystore', keystore,
    '-storepass:env', 'UNDERVEIS_KEY_PASSWORD', '-keypass:env', 'UNDERVEIS_KEY_PASSWORD',
    '-alias', 'underveis', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Underveis Local Build'], root, signing);
  chmodSync(keystore, 0o600);
}
run(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install']);
const gradleFile = path.join(root, 'android/app/build.gradle');
let gradle = readFileSync(gradleFile, 'utf8');
if (!gradle.includes('signingConfigs.underveis')) {
  gradle = gradle.replace('signingConfigs {', `signingConfigs {
        underveis {
            storeFile file(System.getenv('UNDERVEIS_KEYSTORE'))
            storePassword System.getenv('UNDERVEIS_KEY_PASSWORD')
            keyAlias 'underveis'
            keyPassword System.getenv('UNDERVEIS_KEY_PASSWORD')
        }`);
  gradle = gradle.replace(/(release\s*\{[\s\S]*?signingConfig )signingConfigs\.debug/, '$1signingConfigs.underveis');
  if (!gradle.includes('signingConfig signingConfigs.underveis')) throw new Error('Kunne ikke konfigurere release-signering.');
  writeFileSync(gradleFile, gradle);
}
writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${sdk}\n`);
run(path.join(root, 'android/gradlew'), [':app:assembleRelease', '--no-daemon', '--max-workers=4', '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a'], path.join(root, 'android'), signing);
const version = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version;
const apk = path.join(root, `artifacts/underveis-${version}.apk`);
copyFileSync(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
writeFileSync(`${apk}.sha256`, `${createHash('sha256').update(readFileSync(apk)).digest('hex')}  ${path.basename(apk)}\n`);
console.log(`APK klar: ${apk}`);
