"use client";

import { useActionState, useState } from "react";
import {
  createRoomAction,
  type CreateRoomFormState,
} from "@/app/_actions/rooms";

const initialState: CreateRoomFormState = {};

type GameType = "CASH" | "TOURNAMENT";

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(
    createRoomAction,
    initialState,
  );
  const [gameType, setGameType] = useState<GameType>("CASH");
  const [rebuyEnabled, setRebuyEnabled] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-3">
        <legend className="px-2 text-xs uppercase tracking-widest text-zinc-400">
          Tipo de juego
        </legend>
        <div className="flex gap-2">
          <RadioCard
            checked={gameType === "CASH"}
            onChange={() => setGameType("CASH")}
            name="game_type"
            value="CASH"
            title="Mesa libre"
            sub="Jugadores compran fichas cuando entran"
          />
          <RadioCard
            checked={gameType === "TOURNAMENT"}
            onChange={() => setGameType("TOURNAMENT")}
            name="game_type"
            value="TOURNAMENT"
            title="Torneo"
            sub="Buy-in fijo, todos empiezan juntos"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
        <legend className="px-2 text-xs uppercase tracking-widest text-zinc-400">
          Mesa
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="blind_small"
            label="Ciega pequeña (COP)"
            min={500}
            step={500}
            defaultValue={500}
          />
          <NumberField
            name="blind_big"
            label="Ciega grande (COP)"
            min={1000}
            step={500}
            defaultValue={1000}
          />
        </div>
        <NumberField
          name="max_seats"
          label="Asientos máximos"
          min={2}
          max={10}
          defaultValue={9}
        />
      </fieldset>

      {gameType === "CASH" ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
          <legend className="px-2 text-xs uppercase tracking-widest text-zinc-400">
            Mesa libre
          </legend>
          <NumberField
            name="min_buy_in"
            label="Buy-in mínimo (COP)"
            min={500}
            step={500}
            defaultValue={20000}
          />
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
          <legend className="px-2 text-xs uppercase tracking-widest text-zinc-400">
            Torneo
          </legend>
          <NumberField
            name="tournament_cost"
            label="Costo de entrada (COP)"
            min={500}
            step={500}
            defaultValue={50000}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="rebuy_enabled"
              checked={rebuyEnabled}
              onChange={(e) => setRebuyEnabled(e.target.checked)}
              className="h-4 w-4 accent-felt-light"
            />
            Permitir recompra
          </label>
          {rebuyEnabled && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <NumberField
                name="rebuy_cost"
                label="Costo recompra (COP)"
                min={500}
                step={500}
                defaultValue={25000}
              />
              <NumberField
                name="max_rebuys"
                label="Máx. recompras"
                min={1}
                max={20}
                defaultValue={3}
              />
            </div>
          )}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-3">
        <legend className="px-2 text-xs uppercase tracking-widest text-zinc-400">
          Reglas
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="turn_timer_enabled"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
            className="h-4 w-4 accent-felt-light"
          />
          Tiempo de espera por turno
        </label>
        {timerEnabled && (
          <NumberField
            name="turn_timer_seconds"
            label="Segundos por turno"
            min={5}
            max={300}
            defaultValue={30}
          />
        )}
      </fieldset>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-felt py-3 font-semibold hover:bg-felt-light disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear sala"}
      </button>
    </form>
  );
}

function RadioCard({
  checked,
  onChange,
  name,
  value,
  title,
  sub,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  title: string;
  sub: string;
}) {
  return (
    <label
      className={`flex flex-1 cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-sm transition ${
        checked
          ? "border-felt-light bg-felt-dark/40"
          : "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-zinc-400">{sub}</span>
    </label>
  );
}

function NumberField({
  name,
  label,
  ...rest
}: {
  name: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-400">{label}</span>
      <input
        name={name}
        type="number"
        required
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        {...rest}
      />
    </label>
  );
}
