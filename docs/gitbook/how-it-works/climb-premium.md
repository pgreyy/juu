# Climb Premium

{% hint style="info" %}
**Status:** live on testnet (MUSDash v3), on both deployments.
{% endhint %}

The Climb Premium is an extra price for a seat on the top floors, 7 to 10. It is paid on top of your chips.

```
seat premium = base x (1 + r) ^ seats already taken on that floor this epoch
```

Starting settings: base **1 MUSD**, r **10%**. So on each top floor, the first seat of the epoch pays 1 MUSD, the second 1.10, the third 1.21, and so on.

## Who gets it

The premium is shared among the positions **already sitting on that floor**, by size. Early climbers earn from later ones. If nobody is on that floor yet, the premium goes to the Bank.

You collect what you earned when your position closes, moves floors or collapses.

A seat is taken whenever a position opens on a top floor or moves onto one. Players using Y or P chips pay the premium in chips: the Bank pays it in MUSD and takes that value of chips.

## The kill switch

At the end of each Mezo epoch (one week, Thursday to Thursday), Juu compares new top-floor seats with the epoch before. If they fell **below 50%** of the previous epoch, the premium **switches off for good**. Everyone falls back to the real sources of income: veBTC rewards, the Bank's earnings, game fees and collapses.

The keeper checks the switch as each epoch ends, and every new seat checks it too, so it can't be skipped.

The current seat prices and the kill switch status are always public: see `GET /api/:stack/climb-premium` in the [Data API](../agents/data-api.md).

## The demo deployment

The demo deployment uses **15-minute epochs** instead of weeks, so the kill switch can be shown in under an hour.
