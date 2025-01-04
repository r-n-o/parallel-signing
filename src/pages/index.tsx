import Image from "next/image";
import styles from "./index.module.css";
import * as React from "react";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";

type BenchmarkResult = {
  start: number;
  end: number;
  duration: number;
};

function createRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


// Taken from https://www.joshwcomeau.com/react/persisting-react-state-in-localstorage/
// This avoids having to copy/paste API private key, API public key, org ID and address over and over
function useStickyState(defaultValue: any, name: string) {
  const [value, setValue] = React.useState(() => {
    if (
      typeof window === 'undefined' ||
      !window.localStorage
    ) {
      return defaultValue;
    }

    const persistedValue =
      window.localStorage.getItem(name);

    return persistedValue !== null
      ? JSON.parse(persistedValue)
      : defaultValue;
  });

  React.useEffect(() => {
    window.localStorage.setItem(
      name,
      JSON.stringify(value)
    );
  }, [name, value]);

  return [value, setValue];
}

export default function Home() {
  const [formData, setFormData] = useStickyState({
    organizationId: "",
    apiPublicKey: "",
    apiPrivateKey: "",
    signWith: "",
    numSignatures: 10,
  }, "parallel_signing_form_data")

  const [benchmarkResult, setBenchmarkResult] = React.useState<BenchmarkResult | null>(null)
  
  const handleChange = (e: any) => {
    if (e.target) {
      const target = e.target as HTMLInputElement;
      setFormData({
        ...formData,
        [target.name]: target.value
      });
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const stamper = new ApiKeyStamper({
      apiPublicKey: formData.apiPublicKey,
      apiPrivateKey: formData.apiPrivateKey,
    });
    
    const httpClient = new TurnkeyClient(
      { baseUrl: "https://api.turnkey.com" },
      stamper
    );

    // Just a sanity check: do we have a correct API key stamper and org ID? If not, this should fail loudly.
    const whoamiResult = await httpClient.getWhoami({organizationId: formData.organizationId})
    console.log("INFO: logged in as " + whoamiResult);

    const start = new Date().getTime();
    
    let signingPromises = [];
    for (let i=0; i<formData.numSignatures; i++) {
      signingPromises.push(httpClient.signRawPayload({
        type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
        timestampMs: new Date().getTime().toString(),
        organizationId: formData.organizationId,
        parameters: {
          signWith: formData.signWith,
          payload: createRandomString(20),
          encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
          hashFunction: "HASH_FUNCTION_SHA256"
        }
      }))
    }
    
    // This is the step which waits on all signing promises to complete
    await Promise.all(signingPromises)
    
    const end = new Date().getTime();
    
    setBenchmarkResult({
      start: start,
      end: end,
      duration: end-start,
    })
  };

  return (
    <main className={styles.main}>
      <a
        href="https://www.turnkey.com"
        className={styles.logo}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="/logo.svg"
          alt="Turnkey Logo"
          className={styles.turnkeyLogo}
          width={100}
          height={24}
          priority
        />
      </a>
        <div className={styles.base}>
          <h2 className={styles.prompt}>Parallel Signing Demo</h2>
          <form
            className={styles.form}
            onSubmit={handleSubmit}
          >
            <label className={styles.label}>
              Organization ID
              <input
                className={styles.input}
                name="organizationId"
                value={formData.organizationId}
                onChange={handleChange}
              />
            </label>
            <label className={styles.label}>
              API Public Key
              <input
                className={styles.input}
                name="apiPublicKey"
                value={formData.apiPublicKey}
                onChange={handleChange}
              />
            </label>
            <label className={styles.label}>
              API Private Key
              <input
                className={styles.input}
                name="apiPrivateKey"
                type="password"
                value={formData.apiPrivateKey}
                onChange={handleChange}
              />
            </label>
            <label className={styles.label}>
              Sign With (address)
              <input
                className={styles.input}
                name="signWith"
                value={formData.signWith}
                onChange={handleChange}
              />
            </label>
            <label className={styles.label}>
              Num Signatures to perform
              <input
                className={styles.input}
                name="numSignatures"
                value={formData.numSignatures}
                onChange={handleChange}
              />
            </label>
            <input
              className={styles.button}
              type="submit"
              value="Parallel sign"
            />
          </form>
          { benchmarkResult && (
            <div>Result: {formData.numSignatures} signatures performed in {benchmarkResult.duration}ms</div>
          )}
        </div>      
    </main>
  );
}
