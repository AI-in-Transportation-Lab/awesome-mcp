"""IDL types for the Cyclone DDS ping-pong benchmark (no `from __future__ import annotations`
here, because cyclonedds resolves the annotations eagerly)."""
from dataclasses import dataclass
from cyclonedds.idl import IdlStruct
from cyclonedds.idl.types import sequence, uint32, uint8


@dataclass
class Frame(IdlStruct, typename="aas.Frame"):
    seq: uint32
    payload: sequence[uint8]   # Protobuf-encoded PerceptionFrame carried opaquely
