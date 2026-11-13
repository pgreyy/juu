# Loop

{% hint style="info" %}
**Status:** live on testnet, on both deployments.
{% endhint %}

The Loop turns MUSDash winnings into a bigger BTC lock.

1. You win MUSD in MUSDash.
2. Juu swaps the winnings to BTC on Mezo's DEX.
3. The BTC is added to the series you chose, and you get new P and Y for it.

A bigger lock earns a bigger harvest, so your Y grows, and so does the margin it gives you next time.

## Turning it on

* The Loop is **off by default**. Each player turns it on or off for themselves: `setLoop(on, seriesId)` on the Loop contract.
* It is for players who came in through **veBTC or plain BTC**: you can turn it on for a series only while you hold that series' P or Y, and only while the series takes deposits.
* Everyone else, and anyone with the Loop off, always gets MUSD.
* Only the winnings loop. Your chips come back as before.
* If you play through an agent, your Loop setting applies to the agent's winnings too. An agent can change it only if you allowed that in its session.

## The price loss limit

Each swap must return at least Mezo's oracle amount minus a limit (12% on testnet, because Mezo's testnet MUSD/BTC pool sits about 10% away from the oracle price). If a swap would lose more, or the series has stopped taking deposits, you get your winnings in MUSD instead. A close never fails because of the Loop.
