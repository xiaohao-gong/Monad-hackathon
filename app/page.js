"use client";

import { useState, useEffect } from "react";
import WalletConnect from "./components/WalletConnect";
import Exchange from "./components/Exchange";
import FundSelector from "./components/FundSelector";

export default function Home() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // 合约地址（部署后需要更新）
  const CONTRACT_ADDRESSES = {
    MSZ_TOKEN: process.env.NEXT_PUBLIC_MSZ_TOKEN_ADDRESS || "",
    MON_TOKEN: process.env.NEXT_PUBLIC_MON_TOKEN_ADDRESS || "",
    EXCHANGE: process.env.NEXT_PUBLIC_EXCHANGE_ADDRESS || "",
  };

  // Monad测试网Chain ID (41443 = 0xa1cb)
  const MONAD_TESTNET_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID
    ? `0x${parseInt(process.env.NEXT_PUBLIC_CHAIN_ID).toString(16)}`
    : "0xa1cb";

  useEffect(() => {
    // 检查是否已连接钱包
    checkWalletConnection();

    // 监听账户变化
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged,
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        const chainId = await window.ethereum.request({
          method: "eth_chainId",
        });

        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setChainId(chainId);
        }
      } catch (error) {
        console.error("检查钱包连接失败:", error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (chainId) => {
    setChainId(chainId);
    // 页面重新加载以应用新的链ID
    window.location.reload();
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        alert("请安装MetaMask钱包");
        return;
      }

      // 只连接钱包，不自动切换网络
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });

      setAccount(accounts[0]);
      setChainId(chainId);

      // 请求签名以验证身份
      await requestSignature(accounts[0]);
    } catch (error) {
      console.error("连接钱包失败:", error);
      if (error.code === 4001) {
        alert("用户拒绝了连接请求");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToMonadTestnet = async () => {
    if (!window.ethereum) {
      alert("请安装MetaMask钱包");
      return;
    }

    try {
      // 先尝试切换网络123 starry
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
        });
      } catch (switchError) {
        // 如果链不存在（错误代码4902），询问用户是否添加
        if (switchError.code === 4902) {
          const shouldAdd = confirm("Monad测试网未添加到钱包，是否添加？");
          if (!shouldAdd) {
            return; // 用户取消，不添加网络
          }

          // 用户确认后才添加网络
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: MONAD_TESTNET_CHAIN_ID,
                  chainName: "Monad Testnet",
                  nativeCurrency: {
                    name: "MON",
                    symbol: "MON",
                    decimals: 18,
                  },
                  rpcUrls: ["https://testnet-rpc.monad.xyz"],
                  blockExplorerUrls: ["https://testnet-explorer.monad.xyz"],
                },
              ],
            });
          } catch (addError) {
            console.error("添加Monad测试网失败:", addError);
            alert("添加网络失败，请手动在钱包中添加Monad测试网");
            throw addError;
          }
        } else {
          // 其他错误，可能是用户拒绝了切换
          console.error("切换网络失败:", switchError);
          throw switchError;
        }
      }

      // 网络切换成功后，更新chainId
      const newChainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      setChainId(newChainId);
    } catch (error) {
      console.error("网络切换失败:", error);
      // 不显示错误，让用户自行处理
    }
  };

  const requestSignature = async (address) => {
    try {
      const message = `欢迎使用MSZ私募基金代币化平台\n\n请签名以验证身份\n\n地址: ${address}`;
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });
      console.log("签名成功:", signature);
    } catch (error) {
      console.error("签名失败:", error);
      // 签名失败不影响连接，只记录错误
    }
  };

  const isCorrectNetwork = chainId === MONAD_TESTNET_CHAIN_ID;

  return (
    <div
      className="container"
      style={{ minHeight: "100vh", padding: "2rem 1rem" }}
    >
      <header style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
          MSZ 私募基金代币化平台
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          使用MON代币兑换MSZ代币，参与私募基金投资
        </p>
      </header>

      <WalletConnect
        account={account}
        chainId={chainId}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        isCorrectNetwork={isCorrectNetwork}
        onSwitchNetwork={switchToMonadTestnet}
      />

      {account && isCorrectNetwork && (
        <>
          <FundSelector account={account} />
          <Exchange account={account} contractAddresses={CONTRACT_ADDRESSES} />
        </>
      )}

      {account && !isCorrectNetwork && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="error">请切换到Monad测试网</p>
          <button
            className="btn btn-primary"
            onClick={switchToMonadTestnet}
            style={{ marginTop: "1rem" }}
          >
            切换到Monad测试网
          </button>
        </div>
      )}
    </div>
  );
}
