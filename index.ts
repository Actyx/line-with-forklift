import { Fish, FishId, Pond, Tags } from '@actyx/pond'
interface MachinePartsEvent {
    type: 'produced' | 'picked-up'
    qty: number
}

export const MACHINE_BUFFER_SIZE = 3;
export const ROBOT_IN_BUFFER_SIZE = 9;
export const ROBOT_OUT_BUFFER_SIZE = 9;

interface MachineState {
    bufferQty: number
}

export const MachineFish: Fish<MachineState, MachinePartsEvent> = {
    fishId: FishId.of('machine', 'machine', 0),
    initialState: { bufferQty: 0 },
    where: Tags<MachinePartsEvent>('machine'),
    onEvent: (state, event) => {
        if (event.type === 'produced') {
            return { ...state, bufferQty: state.bufferQty + event.qty }
        } else if (event.type === 'picked-up') {
            return { ...state, bufferQty: state.bufferQty - event.qty }
        }
        return state
    }
}

function emitMachineProducedParts(pond: Pond, qty: number) {
    pond.emit(Tags<MachinePartsEvent>('machine'), {
        type: 'produced',
        qty: qty,
    }).toPromise().catch(console.error)
}

function emitMachinePartsPickedUp(pond: Pond, qty: number) {
    pond.emit(Tags<MachinePartsEvent>('machine'), {
        type: 'picked-up',
        qty: qty,
    }).toPromise().catch(console.error)
}

interface RobotPartsEvent {
    type: 'picked-up-from-machine' | 'packaged' | 'picked-up'
    qty: number
}

function emitRobotPickedUpFromMachine(pond: Pond, qty: number) {
    pond.emit(Tags<RobotPartsEvent>('robot'), {
        type: 'picked-up-from-machine',
        qty: qty,
    }).toPromise().catch(console.error)
}

function emitRobotPackaged(pond: Pond, qty: number) {
    pond.emit(Tags<RobotPartsEvent>('robot'), {
        type: 'packaged',
        qty: qty,
    }).toPromise().catch(console.error)
}

function emitRobotPartsPickedUp(pond: Pond, qty: number) {
    pond.emit(Tags<RobotPartsEvent>('robot'), {
        type: 'picked-up',
        qty: qty,
    }).toPromise().catch(console.error)
}

interface RobotState {
    inputQty: number
    packagedQty: number
}

export const RobotFish: Fish<RobotState, RobotPartsEvent> = {
    fishId: FishId.of('robot', 'robot', 0),
    initialState: { inputQty: 0, packagedQty: 0 },
    where: Tags<RobotPartsEvent>('robot'),
    onEvent: (state, event) => {
        if (event.type === 'picked-up-from-machine') {
            return { ...state, inputQty: state.inputQty + event.qty }
        } else if (event.type === 'packaged') {
            return {
                ...state,
                inputQty: state.inputQty - event.qty,
                packagedQty: state.packagedQty + event.qty,
            }
        } else if (event.type === 'picked-up') {
            return { ...state, packagedQty: state.packagedQty - event.qty }
        }
        return state
    }
}


async function runMachine(pond: Pond) {

    let currentlyProducing = false

    pond.observe(MachineFish, state => {
        console.clear()
        if (!currentlyProducing && state.bufferQty < MACHINE_BUFFER_SIZE) {
            currentlyProducing = true
            console.log(`machine: PRODUCING`)
            setTimeout(function () {
                currentlyProducing = false
                emitMachineProducedParts(pond, 1)
            }, 2_000)
        } else {
            console.log(`machine: ${currentlyProducing ? 'PRODUCING' : 'IDLE'}`)
        }
    })
}

async function runRobot(pond: Pond) {
    console.log(`running robot`)

    let robotState: RobotState | undefined = undefined;
    let machineState: MachineState | undefined = undefined;
    let currentlyPickingUp: boolean = false
    let currentlyPackaging: boolean = false

    function printState() {
        console.clear()
        console.log(`robot is ${currentlyPackaging ? 'PACKAGING' : currentlyPickingUp ? 'PICKING UP' : 'IDLE'}`)
    }

    function onChanged() {
        printState()
        if (!robotState || !machineState || currentlyPickingUp || currentlyPackaging) { return }
        if (machineState.bufferQty > 1 && robotState.inputQty < ROBOT_IN_BUFFER_SIZE) {
            currentlyPickingUp = true
            printState()
            setTimeout(function () {
                printState()
                emitMachinePartsPickedUp(pond, 2)
                emitRobotPickedUpFromMachine(pond, 2)
                currentlyPickingUp = false
            }, 1_000)
        }

        if (robotState.inputQty > 0 && robotState.packagedQty < ROBOT_OUT_BUFFER_SIZE) {
            currentlyPackaging = true
            printState()
            setTimeout(function () {
                printState()
                emitRobotPackaged(pond, 1)
                currentlyPackaging = false
            }, 1_000)
        }
    }

    pond.observe(RobotFish, state => {
        robotState = state;
        onChanged()
    })

    pond.observe(MachineFish, state => {
        machineState = state
        onChanged()
    })

}

async function runForklift(pond: Pond) {
    console.log(`running forklift`)

    let currentlyDroppingOff = false

    pond.observe(RobotFish, state => {
        console.clear()
        console.log(`forklift: ${currentlyDroppingOff ? 'WORKING' : 'IDLE'}`)
        if (!currentlyDroppingOff && state.packagedQty > 0) {
            currentlyDroppingOff = true
            emitRobotPartsPickedUp(pond, state.packagedQty)
            setTimeout(function () {
                currentlyDroppingOff = false
            }, 20_000)
        }

    })
}

async function runDashboard(pond: Pond) {

    let machineState: MachineState | undefined = undefined
    let robotState: RobotState | undefined = undefined

    function onChanged() {
        if (!machineState || !robotState) { return }
        console.clear()
        console.log(`Machine`)
        console.log(` . out: ${machineState.bufferQty} ${[...Array(Math.max(0, machineState.bufferQty))].map(() => "#").join('')}`)
        console.log(`Robot`)
        console.log(` . in:  ${robotState.inputQty} ${[...Array(Math.max(0, robotState.inputQty))].map(() => "#").join('')}`)
        console.log(` . out: ${robotState.packagedQty} ${[...Array(Math.max(0, robotState.packagedQty))].map(() => "#").join('')}`)

    }

    pond.observe(MachineFish, state => {
        machineState = state
        onChanged()
    })
    pond.observe(RobotFish, state => {
        robotState = state
        onChanged()
    })


}

(async () => {
    const pond = await Pond.default({
        appId: 'com.example.app',
        displayName: 'My Demo',
        version: '1.0.0',
    })

    const program = process.argv[2]
    if (program === 'machine') {
        await runMachine(pond)
    } else if (program === 'robot') {
        await runRobot(pond)
    } else if (program === 'forklift') {
        await runForklift(pond)
    } else if (program === 'dashboard') {
        await runDashboard(pond)

    } else {
        console.log(`please set which program to run`)
        process.exit(1)
    }
})()